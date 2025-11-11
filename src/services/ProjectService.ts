import { Project } from '../components/scheme/models/Project';
import { ProjectSchema } from '../components/scheme/types/schema';

export class ProjectService {
  private static currentProject: Project = new Project();

  // Получение текущего проекта
  static getCurrentProject(): Project {
    return this.currentProject;
  }

  // Установка текущего проекта
  static setCurrentProject(project: Project): void {
    this.currentProject = project;
  }

  // Загрузка проекта из Redux состояния
  static loadFromReduxState(schema: ProjectSchema): void {
    this.currentProject = Project.deserialize(schema);
  }

  // Сохранение проекта в Redux состояние
  static saveToReduxState(): ProjectSchema {
    return this.currentProject.serialize();
  }

  // Быстрое создание компонента и добавление в проект
  static addComponentToProject(
    componentType: string,
    position?: { x: number; y: number }
  ): any {
    // Здесь будет логика создания компонента через ComponentFactory
    // и добавления в currentProject
    return {}; // Возвращаем сериализованный компонент для Redux
  }

  // Получение сериализованного состояния для Redux
  static getSerializedState(): ProjectSchema {
    return this.currentProject.serialize();
  }
}
